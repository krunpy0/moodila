package repository

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func (r Feed) EditComment(ctx context.Context, viewerID, commentID, text string) error {
	var entryID string
	if err := r.Pool.QueryRow(ctx, `SELECT entry_id FROM comments WHERE id = $1 AND user_id = $2`, commentID, viewerID).Scan(&entryID); err != nil {
		return err
	}
	accessible, err := r.canAccessEntry(ctx, viewerID, entryID)
	if err != nil {
		return err
	}
	if !accessible {
		return pgx.ErrNoRows
	}
	tag, err := r.Pool.Exec(ctx, `UPDATE comments SET text = $3 WHERE id = $1 AND user_id = $2`, commentID, viewerID, text)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
