"use client";
import { useId } from "react";
import { BookOpen, CheckSquare2, FilePenLine } from "lucide-react";
import { summarizeStudy } from "@/lib/study-summary";
import { useStudy } from "@/components/study/provider";
export function StudySummary() {
  const { themes, items, records } = useStudy();
  const value = summarizeStudy(themes, items, records);
  const id = useId();
  const length = 2 * Math.PI * 41;
  return (
    <section className="trace-summary" aria-label="学習の軌跡">
      <h2>学習の軌跡</h2>
      <div className="summary-content">
        <div
          className="summary-ring"
          role="img"
          aria-label={`全項目の習得率 ${value.percent}%`}
        >
          <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
            <defs>
              <pattern
                id={id}
                width="4"
                height="4"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(35)"
              >
                <path
                  d="M0 0v4"
                  stroke="var(--pencil)"
                  strokeWidth=".7"
                  opacity=".28"
                />
              </pattern>
            </defs>
            <circle
              cx="50"
              cy="50"
              r="41"
              stroke="var(--surface)"
              strokeWidth="9"
            />
            <circle
              cx="50"
              cy="50"
              r="41"
              stroke={`url(#${id})`}
              strokeWidth="9"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              stroke="var(--muted)"
              strokeWidth=".5"
              strokeDasharray="3 1 7 2"
            />
            <circle
              cx="50"
              cy="50"
              r="41"
              stroke="var(--accent)"
              strokeWidth="8"
              strokeDasharray={`${(length * value.percent) / 100} ${length}`}
              opacity={value.percent > 0 ? 1 : 0}
              transform="rotate(-90 50 50)"
              strokeLinecap="round"
            />
            <circle
              cx="50"
              cy="50"
              r="36"
              stroke="var(--muted)"
              strokeWidth=".45"
            />
          </svg>
          <span className="summary-percent">
            {value.percent}
            <small>%</small>
          </span>
          <span className="summary-caption">習得率</span>
        </div>
        <dl className="summary-metrics">
          <div>
            <dt>
              <BookOpen />
              <span>学習テーマ</span>
            </dt>
            <dd>{value.themeCount}</dd>
          </div>
          <div>
            <dt>
              <CheckSquare2 />
              <span>習得した項目</span>
            </dt>
            <dd>{value.completed}</dd>
          </div>
          <div>
            <dt>
              <FilePenLine />
              <span>思考の記録</span>
            </dt>
            <dd>{value.recordCount}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
