package main

import (
	"encoding/json"
	"time"
)

// SplitDefinition represents a predefined split with name and icon
type SplitDefinition struct {
	Name string `json:"name"`
	Icon string `json:"icon"` // base64 encoded image or emoji
}

// Split represents a single split with name, segment time, cumulative time, and delta
type Split struct {
	Name           string        `json:"name"`
	SegmentTime    time.Duration `json:"segmentTime"`
	CumulativeTime time.Duration `json:"cumulativeTime"`
	Delta          time.Duration `json:"delta"` // Difference from best cumulative time (negative = ahead, positive = behind)
}

// TimerState holds the current state of the timer
type TimerState struct {
	CurrentTime       time.Duration     `json:"currentTime"`
	Status            string            `json:"status"` // "stopped", "running", "paused"
	Splits            []Split           `json:"splits"`
	PredefinedSplits  []SplitDefinition `json:"predefinedSplits"`
	TimerTitle        string            `json:"timerTitle"`
	CurrentSplitIndex int               `json:"currentSplitIndex"`
	StartTime         time.Time         `json:"-"` // not serialized
	PausedAt          time.Duration     `json:"-"` // not serialized

	// Best time tracking
	BestSplitTimes      []time.Duration `json:"bestSplitTimes"`      // Best segment time for each split
	BestCumulativeTimes []time.Duration `json:"bestCumulativeTimes"` // Best cumulative time for each split
	PersonalBest        time.Duration   `json:"personalBest"`        // Overall personal best (full run time)
	SumOfBest           time.Duration   `json:"sumOfBest"`           // Sum of all best segment times
	PBSplitTimes        []time.Duration `json:"pbSplitTimes"`        // Cumulative times from the personal best run
	WorldRecord         time.Duration   `json:"worldRecord"`         // World record time
}

// NewTimerState creates a new timer state
func NewTimerState() *TimerState {
	return &TimerState{
		CurrentTime:         0,
		Status:              "stopped",
		Splits:              []Split{},
		PredefinedSplits:    []SplitDefinition{},
		TimerTitle:          "OpenSplit",
		CurrentSplitIndex:   -1,
		BestSplitTimes:      []time.Duration{},
		BestCumulativeTimes: []time.Duration{},
		PersonalBest:        0,
		SumOfBest:           0,
		PBSplitTimes:        []time.Duration{},
		WorldRecord:         0,
	}
}

// Start starts or resumes the timer
func (ts *TimerState) Start() {
	now := time.Now()
	switch ts.Status {
	case "stopped":
		ts.StartTime = now
		ts.PausedAt = 0
		// Set current split index to 0 (first split) when starting from stopped
		if len(ts.PredefinedSplits) > 0 {
			ts.CurrentSplitIndex = 0
		}
	case "paused":
		ts.StartTime = now.Add(-ts.PausedAt)
	}
	ts.Status = "running"
}

// Pause toggles pause/unpause
func (ts *TimerState) Pause() {
	switch ts.Status {
	case "running":
		ts.PausedAt = time.Since(ts.StartTime)
		ts.Status = "paused"
	case "paused":
		ts.StartTime = time.Now().Add(-ts.PausedAt)
		ts.Status = "running"
	}
}

// Reset resets the timer
func (ts *TimerState) Reset() {
	ts.CurrentTime = 0
	ts.Status = "stopped"
	ts.Splits = []Split{}
	ts.CurrentSplitIndex = -1
	ts.StartTime = time.Time{}
	ts.PausedAt = 0
}

// SetPredefinedSplits sets the predefined splits
func (ts *TimerState) SetPredefinedSplits(splits []SplitDefinition, title string) {
	ts.PredefinedSplits = splits
	ts.TimerTitle = title
	ts.CurrentSplitIndex = -1
	if ts.Status == "stopped" {
		ts.Splits = []Split{}
	}
	// Initialize best times arrays to match number of splits
	numSplits := len(splits)
	if len(ts.BestSplitTimes) != numSplits {
		ts.BestSplitTimes = make([]time.Duration, numSplits)
		ts.BestCumulativeTimes = make([]time.Duration, numSplits)
		ts.PBSplitTimes = make([]time.Duration, numSplits)
	}
}

// NextSplit advances to the next predefined split
func (ts *TimerState) NextSplit() {
	if ts.Status != "running" || ts.CurrentSplitIndex < 0 || ts.CurrentSplitIndex >= len(ts.PredefinedSplits) {
		return
	}

	// Calculate times for the current split being completed
	segmentTime := time.Since(ts.StartTime)
	if len(ts.Splits) > 0 {
		segmentTime -= ts.Splits[len(ts.Splits)-1].CumulativeTime
	}
	ts.CurrentTime = time.Since(ts.StartTime)

	// Calculate delta (difference from best cumulative time)
	var delta time.Duration
	if ts.CurrentSplitIndex < len(ts.BestCumulativeTimes) && ts.BestCumulativeTimes[ts.CurrentSplitIndex] > 0 {
		// Delta = current cumulative - best cumulative
		// Negative = ahead (better), Positive = behind (worse)
		delta = ts.CurrentTime - ts.BestCumulativeTimes[ts.CurrentSplitIndex]
	}

	// Update best times for this split
	if ts.CurrentSplitIndex < len(ts.BestSplitTimes) {
		// Update best segment time if this is better or first time
		if ts.BestSplitTimes[ts.CurrentSplitIndex] == 0 || segmentTime < ts.BestSplitTimes[ts.CurrentSplitIndex] {
			ts.BestSplitTimes[ts.CurrentSplitIndex] = segmentTime
			ts.CalculateSumOfBest()
		}

		// Update best cumulative time if this is better or first time
		if ts.BestCumulativeTimes[ts.CurrentSplitIndex] == 0 || ts.CurrentTime < ts.BestCumulativeTimes[ts.CurrentSplitIndex] {
			ts.BestCumulativeTimes[ts.CurrentSplitIndex] = ts.CurrentTime
		}
	}

	// Save the completed split
	ts.Splits = append(ts.Splits, Split{
		Name:           ts.PredefinedSplits[ts.CurrentSplitIndex].Name,
		SegmentTime:    segmentTime,
		CumulativeTime: ts.CurrentTime,
		Delta:          delta,
	})

	// If this was the last split, stop the timer and check for new PB
	if ts.CurrentSplitIndex == len(ts.PredefinedSplits)-1 {
		ts.Status = "stopped"
		if ts.PersonalBest == 0 || ts.CurrentTime < ts.PersonalBest {
			ts.PersonalBest = ts.CurrentTime
			// Save all split times from this run as the new PB run
			ts.PBSplitTimes = make([]time.Duration, len(ts.Splits))
			for i, split := range ts.Splits {
				ts.PBSplitTimes[i] = split.CumulativeTime
			}
			// Check if new PB beats world record
			if ts.WorldRecord > 0 && ts.PersonalBest < ts.WorldRecord {
				ts.WorldRecord = ts.PersonalBest
			}
		}
		// Set index to -1 to indicate run is complete
		ts.CurrentSplitIndex = -1
	} else {
		// Move to the next split
		ts.CurrentSplitIndex++
	}
}

// Update updates the current time if running
func (ts *TimerState) Update() {
	if ts.Status == "running" {
		ts.CurrentTime = time.Since(ts.StartTime)
	}
}

// ToJSON serializes the timer state to JSON
func (ts *TimerState) ToJSON() []byte {
	data, _ := json.Marshal(ts)
	return data
}

// CalculateSumOfBest computes the sum of all best segment times
func (ts *TimerState) CalculateSumOfBest() {
	ts.SumOfBest = 0
	for _, bestTime := range ts.BestSplitTimes {
		ts.SumOfBest += bestTime
	}
}

// GetCurrentDelta returns the delta for the current running split
// This is used to show real-time delta during an active split
func (ts *TimerState) GetCurrentDelta() time.Duration {
	if ts.Status != "running" || ts.CurrentSplitIndex < 0 {
		return 0
	}

	// Calculate what the next split index would be (the one we're currently working on)
	nextSplitIndex := ts.CurrentSplitIndex + 1
	if nextSplitIndex >= len(ts.BestCumulativeTimes) {
		return 0
	}

	// If we don't have a best time for this split yet, no delta to show
	if ts.BestCumulativeTimes[nextSplitIndex] == 0 {
		return 0
	}

	// Delta = current time - best cumulative time for next split
	return ts.CurrentTime - ts.BestCumulativeTimes[nextSplitIndex]
}

// RestorePBData restores personal best data from imported file
func (ts *TimerState) RestorePBData(cmd map[string]interface{}) {
	// Restore best split times
	if bestSplitTimes, ok := cmd["bestSplitTimes"].([]interface{}); ok {
		ts.BestSplitTimes = make([]time.Duration, len(bestSplitTimes))
		for i, val := range bestSplitTimes {
			if floatVal, ok := val.(float64); ok {
				ts.BestSplitTimes[i] = time.Duration(floatVal)
			}
		}
	}

	// Restore best cumulative times
	if bestCumulativeTimes, ok := cmd["bestCumulativeTimes"].([]interface{}); ok {
		ts.BestCumulativeTimes = make([]time.Duration, len(bestCumulativeTimes))
		for i, val := range bestCumulativeTimes {
			if floatVal, ok := val.(float64); ok {
				ts.BestCumulativeTimes[i] = time.Duration(floatVal)
			}
		}
	}

	// Restore personal best
	if personalBest, ok := cmd["personalBest"].(float64); ok {
		ts.PersonalBest = time.Duration(personalBest)
	}

	// Restore sum of best
	if sumOfBest, ok := cmd["sumOfBest"].(float64); ok {
		ts.SumOfBest = time.Duration(sumOfBest)
	}

	// Restore PB split times
	if pbSplitTimes, ok := cmd["pbSplitTimes"].([]interface{}); ok {
		ts.PBSplitTimes = make([]time.Duration, len(pbSplitTimes))
		for i, val := range pbSplitTimes {
			if floatVal, ok := val.(float64); ok {
				ts.PBSplitTimes[i] = time.Duration(floatVal)
			}
		}
	}

	// Restore world record
	if worldRecord, ok := cmd["worldRecord"].(float64); ok {
		ts.WorldRecord = time.Duration(worldRecord)
	}
}
