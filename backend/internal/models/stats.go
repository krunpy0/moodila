package models

type MoodPoint struct {
	Date       string   `json:"date"`
	Label      string   `json:"label"`
	Mood       *float64 `json:"mood"`
	EntryCount int      `json:"entry_count"`
}

type HeatmapDay struct {
	Date      string `json:"date"`
	Mood      *int   `json:"mood"`
	DayOfWeek int    `json:"day_of_week"` // 1=Mon, 7=Sun
}

type TagCorrelation struct {
	Tag           string  `json:"tag"`
	AvgMood       float64 `json:"avg_mood"`
	EntryCount    int     `json:"entry_count"`
	HasEnoughData bool    `json:"has_enough_data"`
}

type DayOfWeekAverage struct {
	Day        int      `json:"day"` // 1=Mon..7=Sun
	DayName    string   `json:"day_name"`
	AvgMood    *float64 `json:"avg_mood"`
	EntryCount int      `json:"entry_count"`
}

type MoodDistribution struct {
	Mood       int     `json:"mood"` // 1..5
	Count      int     `json:"count"`
	Percentage float64 `json:"percentage"`
}

type StatInsight struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"` // "day_pattern" | "tag_correlation" | "general"
	Text        string                 `json:"text"`
	TemplateKey string                 `json:"template_key"`
	Params      map[string]interface{} `json:"params"`
}

type StatsResponse struct {
	Period            string             `json:"period"`
	TotalEntries      int                `json:"total_entries"`
	OverallAvgMood    *float64           `json:"overall_avg_mood"`
	DominantTag       *TagCorrelation    `json:"dominant_tag,omitempty"`
	LowestTag         *TagCorrelation    `json:"lowest_tag,omitempty"`
	HighestTag        *TagCorrelation    `json:"highest_tag,omitempty"`
	MoodSeries        []MoodPoint        `json:"mood_series"`
	HeatmapData       []HeatmapDay       `json:"heatmap_data"`
	TagCorrelation    []TagCorrelation   `json:"tag_correlation"`
	DayOfWeekAverages []DayOfWeekAverage `json:"day_of_week_averages"`
	MoodDistribution  []MoodDistribution `json:"mood_distribution"`
	Insights          []StatInsight      `json:"insights"`
}
