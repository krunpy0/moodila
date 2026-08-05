package repository

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"moodshare/internal/models"
)

const MinTagCountThreshold = 3

var dayNamesRu = map[int]string{
	1: "Понедельник",
	2: "Вторник",
	3: "Среда",
	4: "Четверг",
	5: "Пятница",
	6: "Суббота",
	7: "Воскресенье",
}

var dayNamesShort = map[int]string{
	1: "Mon",
	2: "Tue",
	3: "Wed",
	4: "Thu",
	5: "Fri",
	6: "Sat",
	7: "Sun",
}

var dayPluralsRu = map[int]string{
	1: "понедельникам",
	2: "вторникам",
	3: "средам",
	4: "четвергам",
	5: "пятницам",
	6: "субботам",
	7: "воскресеньям",
}

var monthNamesShort = map[time.Month]string{
	time.January:   "Jan",
	time.February:  "Feb",
	time.March:     "Mar",
	time.April:     "Apr",
	time.May:       "May",
	time.June:      "Jun",
	time.July:      "Jul",
	time.August:    "Aug",
	time.September: "Sep",
	time.October:   "Oct",
	time.November:  "Nov",
	time.December:  "Dec",
}

func (r Entries) GetStats(ctx context.Context, userID, period, timeZone string) (models.StatsResponse, error) {
	loc := time.UTC
	if timeZone = strings.TrimSpace(timeZone); timeZone != "" {
		if l, err := time.LoadLocation(timeZone); err == nil {
			loc = l
		}
	}

	now := time.Now().In(loc)
	todayStr := now.Format("2006-01-02")

	resp := models.StatsResponse{
		Period:            period,
		MoodSeries:        make([]models.MoodPoint, 0),
		HeatmapData:       make([]models.HeatmapDay, 0),
		TagCorrelation:    make([]models.TagCorrelation, 0),
		DayOfWeekAverages: make([]models.DayOfWeekAverage, 0),
		MoodDistribution:  make([]models.MoodDistribution, 0),
		Insights:          make([]models.StatInsight, 0),
	}

	// 1. Overall Avg & Total Entries
	var totalEntries int
	var overallAvg float64
	err := r.Pool.QueryRow(ctx, `
		SELECT COUNT(*)::int, COALESCE(AVG(mood), 0)::float
		FROM entries
		WHERE user_id = $1`, userID,
	).Scan(&totalEntries, &overallAvg)
	if err != nil {
		return resp, fmt.Errorf("failed to fetch overall summary: %w", err)
	}

	resp.TotalEntries = totalEntries
	if totalEntries > 0 {
		avgRounded := math.Round(overallAvg*10) / 10
		resp.OverallAvgMood = &avgRounded
	}

	// 2. Mood Series for requested period (week, month, year)
	resp.MoodSeries, err = r.fetchMoodSeries(ctx, userID, period, now)
	if err != nil {
		return resp, fmt.Errorf("failed to fetch mood series: %w", err)
	}

	// 3. Heatmap Data for current calendar year
	resp.HeatmapData, err = r.fetchHeatmapData(ctx, userID, now.Year())
	if err != nil {
		return resp, fmt.Errorf("failed to fetch heatmap data: %w", err)
	}

	// 4. Tag Correlation
	resp.TagCorrelation, resp.HighestTag, resp.LowestTag, resp.DominantTag, err = r.fetchTagCorrelation(ctx, userID)
	if err != nil {
		return resp, fmt.Errorf("failed to fetch tag correlation: %w", err)
	}

	// 5. Day of Week Averages
	resp.DayOfWeekAverages, err = r.fetchDayOfWeekAverages(ctx, userID)
	if err != nil {
		return resp, fmt.Errorf("failed to fetch day of week averages: %w", err)
	}

	// 6. Mood Distribution (Levels 1..5)
	resp.MoodDistribution, err = r.fetchMoodDistribution(ctx, userID)
	if err != nil {
		return resp, fmt.Errorf("failed to fetch mood distribution: %w", err)
	}

	// 7. Generate Insights (arithmetic rules)
	resp.Insights = generateInsights(resp, todayStr)

	return resp, nil
}

func (r Entries) fetchMoodSeries(ctx context.Context, userID, period string, now time.Time) ([]models.MoodPoint, error) {
	series := make([]models.MoodPoint, 0)

	switch period {
	case "week":
		// Mon-Sun of current week
		weekday := int(now.Weekday())
		if weekday == 0 {
			weekday = 7
		}
		monday := now.AddDate(0, 0, -(weekday - 1))

		startDate := monday.Format("2006-01-02")
		sunday := monday.AddDate(0, 0, 6)
		endDate := sunday.Format("2006-01-02")

		rows, err := r.Pool.Query(ctx, `
			SELECT date::text, AVG(mood)::float, COUNT(*)::int
			FROM entries
			WHERE user_id = $1 AND date >= $2 AND date <= $3
			GROUP BY date`, userID, startDate, endDate)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		entryMap := make(map[string]struct {
			avg   float64
			count int
		})
		for rows.Next() {
			var d string
			var avg float64
			var cnt int
			if err := rows.Scan(&d, &avg, &cnt); err != nil {
				return nil, err
			}
			entryMap[d] = struct {
				avg   float64
				count int
			}{avg: avg, count: cnt}
		}

		for i := 0; i < 7; i++ {
			d := monday.AddDate(0, 0, i)
			dStr := d.Format("2006-01-02")
			dow := int(d.Weekday())
			if dow == 0 {
				dow = 7
			}
			label := dayNamesShort[dow]

			pt := models.MoodPoint{
				Date:  dStr,
				Label: label,
			}
			if val, ok := entryMap[dStr]; ok {
				rounded := math.Round(val.avg*10) / 10
				pt.Mood = &rounded
				pt.EntryCount = val.count
			}
			series = append(series, pt)
		}

	case "year":
		// 12 Months of current calendar year
		year := now.Year()
		startDate := fmt.Sprintf("%d-01-01", year)
		endDate := fmt.Sprintf("%d-12-31", year)

		rows, err := r.Pool.Query(ctx, `
			SELECT TO_CHAR(date, 'YYYY-MM') AS month_key, AVG(mood)::float, COUNT(*)::int
			FROM entries
			WHERE user_id = $1 AND date >= $2 AND date <= $3
			GROUP BY month_key`, userID, startDate, endDate)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		monthMap := make(map[string]struct {
			avg   float64
			count int
		})
		for rows.Next() {
			var mKey string
			var avg float64
			var cnt int
			if err := rows.Scan(&mKey, &avg, &cnt); err != nil {
				return nil, err
			}
			monthMap[mKey] = struct {
				avg   float64
				count int
			}{avg: avg, count: cnt}
		}

		for m := 1; m <= 12; m++ {
			mKey := fmt.Sprintf("%d-%02d", year, m)
			tMonth := time.Month(m)
			label := monthNamesShort[tMonth]

			pt := models.MoodPoint{
				Date:  mKey,
				Label: label,
			}
			if val, ok := monthMap[mKey]; ok {
				rounded := math.Round(val.avg*10) / 10
				pt.Mood = &rounded
				pt.EntryCount = val.count
			}
			series = append(series, pt)
		}

	default: // "month"
		// Days of current month
		year, month, _ := now.Date()
		firstDay := time.Date(year, month, 1, 0, 0, 0, 0, now.Location())
		lastDay := firstDay.AddDate(0, 1, -1)

		startDate := firstDay.Format("2006-01-02")
		endDate := lastDay.Format("2006-01-02")

		rows, err := r.Pool.Query(ctx, `
			SELECT date::text, AVG(mood)::float, COUNT(*)::int
			FROM entries
			WHERE user_id = $1 AND date >= $2 AND date <= $3
			GROUP BY date`, userID, startDate, endDate)
		if err != nil {
			return nil, err
		}
		defer rows.Close()

		entryMap := make(map[string]struct {
			avg   float64
			count int
		})
		for rows.Next() {
			var d string
			var avg float64
			var cnt int
			if err := rows.Scan(&d, &avg, &cnt); err != nil {
				return nil, err
			}
			entryMap[d] = struct {
				avg   float64
				count int
			}{avg: avg, count: cnt}
		}

		numDays := lastDay.Day()
		for i := 1; i <= numDays; i++ {
			d := time.Date(year, month, i, 0, 0, 0, 0, now.Location())
			dStr := d.Format("2006-01-02")
			label := fmt.Sprintf("%d", i)

			pt := models.MoodPoint{
				Date:  dStr,
				Label: label,
			}
			if val, ok := entryMap[dStr]; ok {
				rounded := math.Round(val.avg*10) / 10
				pt.Mood = &rounded
				pt.EntryCount = val.count
			}
			series = append(series, pt)
		}
	}

	return series, nil
}

func (r Entries) fetchHeatmapData(ctx context.Context, userID string, year int) ([]models.HeatmapDay, error) {
	startDate := fmt.Sprintf("%d-01-01", year)
	endDate := fmt.Sprintf("%d-12-31", year)

	rows, err := r.Pool.Query(ctx, `
		SELECT date::text, mood
		FROM entries
		WHERE user_id = $1 AND date >= $2 AND date <= $3`, userID, startDate, endDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entryMap := make(map[string]int)
	for rows.Next() {
		var d string
		var mood int
		if err := rows.Scan(&d, &mood); err != nil {
			return nil, err
		}
		entryMap[d] = mood
	}

	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, err
	}
	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, err
	}

	heatmap := make([]models.HeatmapDay, 0, 366)
	for d := start; !d.After(end); d = d.AddDate(0, 0, 1) {
		dStr := d.Format("2006-01-02")
		dow := int(d.Weekday())
		if dow == 0 {
			dow = 7
		}

		dayObj := models.HeatmapDay{
			Date:      dStr,
			DayOfWeek: dow,
		}
		if moodVal, ok := entryMap[dStr]; ok {
			dayObj.Mood = &moodVal
		}
		heatmap = append(heatmap, dayObj)
	}

	return heatmap, nil
}

func (r Entries) fetchTagCorrelation(ctx context.Context, userID string) ([]models.TagCorrelation, *models.TagCorrelation, *models.TagCorrelation, *models.TagCorrelation, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT tag, AVG(mood)::float, COUNT(*)::int
		FROM entries
		CROSS JOIN LATERAL UNNEST(entries.tags) AS tags(tag)
		WHERE user_id = $1
		GROUP BY tag
		ORDER BY COUNT(*) DESC, LOWER(tag) ASC`, userID)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	defer rows.Close()

	tags := make([]models.TagCorrelation, 0)
	var highest, lowest, dominant *models.TagCorrelation

	for rows.Next() {
		var tag string
		var avg float64
		var cnt int
		if err := rows.Scan(&tag, &avg, &cnt); err != nil {
			return nil, nil, nil, nil, err
		}
		avgRounded := math.Round(avg*10) / 10
		item := models.TagCorrelation{
			Tag:           tag,
			AvgMood:       avgRounded,
			EntryCount:    cnt,
			HasEnoughData: cnt >= MinTagCountThreshold,
		}
		tags = append(tags, item)

		if dominant == nil || item.EntryCount > dominant.EntryCount {
			itemCopy := item
			dominant = &itemCopy
		}

		if item.HasEnoughData {
			if highest == nil || item.AvgMood > highest.AvgMood {
				itemCopy := item
				highest = &itemCopy
			}
			if lowest == nil || item.AvgMood < lowest.AvgMood {
				itemCopy := item
				lowest = &itemCopy
			}
		}
	}

	return tags, highest, lowest, dominant, nil
}

func (r Entries) fetchDayOfWeekAverages(ctx context.Context, userID string) ([]models.DayOfWeekAverage, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT (EXTRACT(ISODOW FROM date::date))::int AS dow, AVG(mood)::float, COUNT(*)::int
		FROM entries
		WHERE user_id = $1
		GROUP BY dow`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	dowMap := make(map[int]struct {
		avg   float64
		count int
	})
	for rows.Next() {
		var dow int
		var avg float64
		var cnt int
		if err := rows.Scan(&dow, &avg, &cnt); err != nil {
			return nil, err
		}
		dowMap[dow] = struct {
			avg   float64
			count int
		}{avg: avg, count: cnt}
	}

	list := make([]models.DayOfWeekAverage, 0, 7)
	for dow := 1; dow <= 7; dow++ {
		item := models.DayOfWeekAverage{
			Day:     dow,
			DayName: dayNamesShort[dow],
		}
		if val, ok := dowMap[dow]; ok {
			rounded := math.Round(val.avg*10) / 10
			item.AvgMood = &rounded
			item.EntryCount = val.count
		}
		list = append(list, item)
	}

	return list, nil
}

func (r Entries) fetchMoodDistribution(ctx context.Context, userID string) ([]models.MoodDistribution, error) {
	rows, err := r.Pool.Query(ctx, `
		SELECT mood, COUNT(*)::int
		FROM entries
		WHERE user_id = $1
		GROUP BY mood`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	countMap := make(map[int]int)
	total := 0
	for rows.Next() {
		var mood, cnt int
		if err := rows.Scan(&mood, &cnt); err != nil {
			return nil, err
		}
		countMap[mood] = cnt
		total += cnt
	}

	list := make([]models.MoodDistribution, 0, 5)
	for m := 1; m <= 5; m++ {
		cnt := countMap[m]
		var pct float64
		if total > 0 {
			pct = math.Round((float64(cnt)/float64(total))*1000) / 10
		}
		list = append(list, models.MoodDistribution{
			Mood:       m,
			Count:      cnt,
			Percentage: pct,
		})
	}

	return list, nil
}

func generateInsights(stats models.StatsResponse, today string) []models.StatInsight {
	insights := make([]models.StatInsight, 0)

	if stats.TotalEntries < 5 || stats.OverallAvgMood == nil {
		return insights
	}

	overallAvg := *stats.OverallAvgMood

	// Insight 1: Day of week pattern
	var minDay *models.DayOfWeekAverage
	var maxDay *models.DayOfWeekAverage

	for i := range stats.DayOfWeekAverages {
		day := &stats.DayOfWeekAverages[i]
		if day.AvgMood == nil || day.EntryCount < 3 {
			continue
		}
		if minDay == nil || *day.AvgMood < *minDay.AvgMood {
			minDay = day
		}
		if maxDay == nil || *day.AvgMood > *maxDay.AvgMood {
			maxDay = day
		}
	}

	if minDay != nil && *minDay.AvgMood <= overallAvg-0.4 {
		diff := math.Round((overallAvg-*minDay.AvgMood)*10) / 10
		pluralRu := dayPluralsRu[minDay.Day]
		insights = append(insights, models.StatInsight{
			ID:          fmt.Sprintf("day_lower_%d", minDay.Day),
			Type:        "day_pattern",
			TemplateKey: "insight.day_lower",
			Text:        fmt.Sprintf("Настроение обычно ниже по %s (на %.1f ниже среднего)", pluralRu, diff),
			Params: map[string]interface{}{
				"day_ru":   pluralRu,
				"day_name": minDay.DayName,
				"diff":     diff,
			},
		})
	} else if maxDay != nil && *maxDay.AvgMood >= overallAvg+0.4 {
		diff := math.Round((*maxDay.AvgMood-overallAvg)*10) / 10
		pluralRu := dayPluralsRu[maxDay.Day]
		insights = append(insights, models.StatInsight{
			ID:          fmt.Sprintf("day_higher_%d", maxDay.Day),
			Type:        "day_pattern",
			TemplateKey: "insight.day_higher",
			Text:        fmt.Sprintf("Настроение обычно выше по %s (на %.1f выше среднего)", pluralRu, diff),
			Params: map[string]interface{}{
				"day_ru":   pluralRu,
				"day_name": maxDay.DayName,
				"diff":     diff,
			},
		})
	}

	// Insight 2: Tag correlation impact
	if stats.LowestTag != nil && stats.LowestTag.AvgMood <= overallAvg-0.5 {
		diff := math.Round((overallAvg-stats.LowestTag.AvgMood)*10) / 10
		insights = append(insights, models.StatInsight{
			ID:          fmt.Sprintf("tag_lower_%s", stats.LowestTag.Tag),
			Type:        "tag_correlation",
			TemplateKey: "insight.tag_lower",
			Text:        fmt.Sprintf("Записи с тегом '%s' в среднем на %.1f ниже общего среднего", stats.LowestTag.Tag, diff),
			Params: map[string]interface{}{
				"tag":  stats.LowestTag.Tag,
				"diff": diff,
			},
		})
	} else if stats.HighestTag != nil && stats.HighestTag.AvgMood >= overallAvg+0.5 {
		diff := math.Round((stats.HighestTag.AvgMood-overallAvg)*10) / 10
		insights = append(insights, models.StatInsight{
			ID:          fmt.Sprintf("tag_higher_%s", stats.HighestTag.Tag),
			Type:        "tag_correlation",
			TemplateKey: "insight.tag_higher",
			Text:        fmt.Sprintf("Записи с тегом '%s' в среднем на %.1f выше общего среднего", stats.HighestTag.Tag, diff),
			Params: map[string]interface{}{
				"tag":  stats.HighestTag.Tag,
				"diff": diff,
			},
		})
	}

	// Limit to max 3 insights
	if len(insights) > 3 {
		insights = insights[:3]
	}

	return insights
}
