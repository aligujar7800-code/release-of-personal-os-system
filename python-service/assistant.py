"""
Memory Assistant - Answers questions about the user's activities.
"""

import os
import sqlite3
import logging
from datetime import datetime, timedelta

logger = logging.getLogger('MemoryOS-AI.assistant')


class MemoryAssistant:
    def __init__(self, db_path, search_engine):
        self.db_path = db_path
        self.search_engine = search_engine

    def _get_db(self):
        """Get a read-only database connection."""
        if not os.path.exists(self.db_path):
            return None
        conn = sqlite3.connect(f'file:{self.db_path}?mode=ro', uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    def answer(self, question):
        """Answer a user question about their activities."""
        question_lower = question.lower()

        # Determine question type and generate appropriate response
        if any(kw in question_lower for kw in ['yesterday', 'did i do yesterday', 'work yesterday']):
            return self._summarize_day(days_ago=1)
        elif any(kw in question_lower for kw in ['today', 'did i do today', 'work today']):
            return self._summarize_day(days_ago=0)
        elif any(kw in question_lower for kw in ['this week', 'week', 'past week']):
            return self._summarize_week()
        elif any(kw in question_lower for kw in ['most used', 'frequently', 'often', 'common']):
            return self._most_used_files()
        elif any(kw in question_lower for kw in ['related', 'similar', 'about', 'project']):
            return self._semantic_search(question)
        elif any(kw in question_lower for kw in ['find', 'search', 'show', 'where', 'which']):
            return self._semantic_search(question)
        else:
            return self._semantic_search(question)

    def _summarize_day(self, days_ago=0):
        """Summarize activities for a specific day."""
        conn = self._get_db()
        if not conn:
            return {'answer': 'No activity data available yet.', 'sources': []}

        try:
            target_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
            day_label = 'today' if days_ago == 0 else 'yesterday' if days_ago == 1 else f'{days_ago} days ago'

            cursor = conn.execute(
                "SELECT type, COUNT(*) as count FROM activities WHERE date(created_at) = ? GROUP BY type",
                (target_date,)
            )
            type_counts = {row['type']: row['count'] for row in cursor.fetchall()}

            cursor = conn.execute(
                "SELECT * FROM activities WHERE date(created_at) = ? ORDER BY created_at DESC LIMIT 20",
                (target_date,)
            )
            recent = [dict(row) for row in cursor.fetchall()]

            cursor = conn.execute(
                "SELECT COUNT(*) as count FROM screenshots WHERE date(created_at) = ?",
                (target_date,)
            )
            screenshot_count = cursor.fetchone()['count']

            if not type_counts and not recent:
                return {'answer': f'No activities recorded {day_label}.', 'sources': []}

            # Build summary
            parts = [f"📅 **Activity Summary for {day_label} ({target_date})**\n"]

            if type_counts:
                parts.append("**Activity Breakdown:**")
                type_labels = {
                    'file_created': '📄 Files Created',
                    'file_modified': '✏️ Files Modified',
                    'file_deleted': '🗑️ Files Deleted',
                    'web_visit': '🌐 Websites Visited',
                    'clipboard': '📋 Clipboard Copies',
                }
                for t, count in type_counts.items():
                    label = type_labels.get(t, t)
                    parts.append(f"  • {label}: {count}")

            if screenshot_count:
                parts.append(f"  • 📸 Screenshots: {screenshot_count}")

            if recent:
                parts.append("\n**Recent Activities:**")
                for act in recent[:10]:  # pyre-ignore
                    time_str = act['created_at'].split('T')[-1][:5] if 'T' in (act['created_at'] or '') else ''
                    parts.append(f"  • [{time_str}] {act['description'] or act['title'] or 'Unknown activity'}")

            conn.close()
            return {'answer': '\n'.join(parts), 'sources': recent[:5]}  # pyre-ignore

        except Exception as e:
            logger.error(f'Summary error: {e}')
            conn.close()
            return {'answer': 'Error generating summary.', 'sources': []}

    def _summarize_week(self):
        """Summarize activities for the past week."""
        conn = self._get_db()
        if not conn:
            return {'answer': 'No activity data available yet.', 'sources': []}

        try:
            week_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')

            cursor = conn.execute(
                "SELECT date(created_at) as day, type, COUNT(*) as count FROM activities WHERE date(created_at) >= ? GROUP BY day, type ORDER BY day DESC",
                (week_ago,)
            )
            rows = cursor.fetchall()

            if not rows:
                return {'answer': 'No activities recorded this week.', 'sources': []}

            # Group by day
            days = {}
            for row in rows:
                day = row['day']
                if day not in days:
                    days[day] = {}
                days[day][row['type']] = row['count']

            parts = ["📊 **Weekly Activity Summary**\n"]
            for day in sorted(days.keys(), reverse=True):
                total = sum(days[day].values())
                parts.append(f"**{day}** — {total} activities")

            # Most active files
            cursor = conn.execute(
                "SELECT title, COUNT(*) as count FROM activities WHERE date(created_at) >= ? AND title IS NOT NULL GROUP BY title ORDER BY count DESC LIMIT 10",
                (week_ago,)
            )
            top_files = cursor.fetchall()

            if top_files:
                parts.append("\n**Most Active Items:**")
                for item in top_files:
                    parts.append(f"  • {item['title']} ({item['count']} activities)")

            conn.close()
            return {'answer': '\n'.join(parts), 'sources': []}

        except Exception as e:
            logger.error(f'Week summary error: {e}')
            conn.close()
            return {'answer': 'Error generating weekly summary.', 'sources': []}

    def _most_used_files(self):
        """Get most used files."""
        conn = self._get_db()
        if not conn:
            return {'answer': 'No activity data available yet.', 'sources': []}

        try:
            cursor = conn.execute(
                "SELECT title, file_path, COUNT(*) as count FROM activities WHERE file_path IS NOT NULL GROUP BY file_path ORDER BY count DESC LIMIT 20"
            )
            files = [dict(row) for row in cursor.fetchall()]

            if not files:
                return {'answer': 'No file activity recorded yet.', 'sources': []}

            parts = ["📂 **Most Used Files**\n"]
            for i, f in enumerate(files, 1):
                parts.append(f"  {i}. **{f['title'] or 'Unknown'}** — {f['count']} interactions")
                if f['file_path']:
                    parts.append(f"     📁 {f['file_path']}")

            conn.close()
            return {'answer': '\n'.join(parts), 'sources': files[:5]}  # pyre-ignore

        except Exception as e:
            logger.error(f'Most used error: {e}')
            conn.close()
            return {'answer': 'Error finding most used files.', 'sources': []}

    def _semantic_search(self, question):
        """Use semantic search to find relevant activities."""
        results = self.search_engine.search(question, top_k=10)

        if not results:
            # Fallback to text search in DB
            conn = self._get_db()
            if conn:
                cursor = conn.execute(
                    "SELECT * FROM activities WHERE title LIKE ? OR description LIKE ? ORDER BY created_at DESC LIMIT 10",
                    (f'%{question}%', f'%{question}%')
                )
                db_results = [dict(row) for row in cursor.fetchall()]
                conn.close()

                if db_results:
                    parts = [f"🔍 **Search Results for:** \"{question}\"\n"]
                    for r in db_results:
                        parts.append(f"  • **{r['title'] or 'Unknown'}** — {r['description'] or ''}")
                        if r.get('file_path'):
                            parts.append(f"    📁 {r['file_path']}")
                    return {'answer': '\n'.join(parts), 'sources': db_results}

            return {'answer': f'No results found for: "{question}"', 'sources': []}

        parts = [f"🔍 **Search Results for:** \"{question}\"\n"]
        for r in results:
            score_pct = int(r['score'] * 100)
            parts.append(f"  • [{score_pct}% match] {r['text'][:200]}")
            parts.append(f"    Source: {r['source_type']}")

        return {'answer': '\n'.join(parts), 'sources': results}
