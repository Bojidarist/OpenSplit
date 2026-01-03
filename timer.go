package main

import (
	"encoding/json"
	"time"
)

// Split represents a single split with name, segment time, and cumulative time
type Split struct {
	Name           string        `json:"name"`
	SegmentTime    time.Duration `json:"segmentTime"`
	CumulativeTime time.Duration `json:"cumulativeTime"`
}

// TimerState holds the current state of the timer
type TimerState struct {
	CurrentTime       time.Duration `json:"currentTime"`
	Status            string        `json:"status"` // "stopped", "running", "paused"
	Splits            []Split       `json:"splits"`
	PredefinedSplits  []string      `json:"predefinedSplits"`
	CurrentSplitIndex int           `json:"currentSplitIndex"`
	StartTime         time.Time     `json:"-"` // not serialized
	PausedAt          time.Duration `json:"-"` // not serialized
}

// NewTimerState creates a new timer state
func NewTimerState() *TimerState {
	return &TimerState{
		CurrentTime:       0,
		Status:            "stopped",
		Splits:            []Split{},
		PredefinedSplits:  []string{},
		CurrentSplitIndex: -1,
	}
}

// Start starts or resumes the timer
func (ts *TimerState) Start() {
	now := time.Now()
	switch ts.Status {
	case "stopped":
		ts.StartTime = now
		ts.PausedAt = 0
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
func (ts *TimerState) SetPredefinedSplits(splits []string) {
	ts.PredefinedSplits = splits
	ts.CurrentSplitIndex = -1
	if ts.Status == "stopped" {
		ts.Splits = []Split{}
	}
}

// NextSplit advances to the next predefined split
func (ts *TimerState) NextSplit() {
	if ts.Status != "running" || ts.CurrentSplitIndex >= len(ts.PredefinedSplits)-1 {
		return
	}
	ts.CurrentSplitIndex++
	segmentTime := time.Since(ts.StartTime)
	if len(ts.Splits) > 0 {
		segmentTime -= ts.Splits[len(ts.Splits)-1].CumulativeTime
	}
	ts.CurrentTime = time.Since(ts.StartTime)
	ts.Splits = append(ts.Splits, Split{
		Name:           ts.PredefinedSplits[ts.CurrentSplitIndex],
		SegmentTime:    segmentTime,
		CumulativeTime: ts.CurrentTime,
	})
	if ts.CurrentSplitIndex == len(ts.PredefinedSplits)-1 {
		ts.Status = "stopped"
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
