const CORAL = '#ee8b8b';
const LEMON = '#f5c543';
const SKY = '#7aa2f7';
const LEAF = '#7bc47f';

type Day = {
  date: number;
  bands?: string[];
  /** 그 날 할 일을 전부 끝냈으면 체크, 아니면 남은 개수 */
  remaining?: number;
  today?: boolean;
};

/** 2026년 9월. 1일이 화요일이라 월요일 칸 하나가 비어 있다. */
const days: (Day | null)[] = [
  null,
  { date: 1, bands: [CORAL], remaining: 1 },
  { date: 2, bands: [CORAL, LEMON], remaining: 2 },
  { date: 3 },
  { date: 4, bands: [SKY] },
  { date: 5, bands: [LEAF] },
  { date: 6 },
  { date: 7, bands: [CORAL] },
  { date: 8, bands: [CORAL, LEMON], remaining: 1 },
  { date: 9 },
  { date: 10, bands: [LEMON] },
  { date: 11, bands: [CORAL, SKY], remaining: 3 },
  { date: 12, bands: [LEAF] },
  { date: 13 },
  { date: 14, bands: [CORAL] },
  { date: 15, bands: [CORAL, LEMON], remaining: 2, today: true },
  { date: 16, bands: [LEMON] },
  { date: 17, bands: [SKY] },
  { date: 18, bands: [CORAL, LEAF], remaining: 1 },
  { date: 19 },
  { date: 20 },
  { date: 21, bands: [LEMON] },
  { date: 22, bands: [CORAL] },
  { date: 23 },
  { date: 24, bands: [SKY, LEMON], remaining: 1 },
  { date: 25, bands: [CORAL] },
  { date: 26 },
  { date: 27 },
  { date: 28, bands: [LEAF] },
  { date: 29, bands: [CORAL] },
  { date: 30, bands: [LEMON], remaining: 2 },
];

const weekdays = [
  { label: '월', color: 'text-subtle' },
  { label: '화', color: 'text-subtle' },
  { label: '수', color: 'text-subtle' },
  { label: '목', color: 'text-subtle' },
  { label: '금', color: 'text-subtle' },
  { label: '토', color: 'text-saturday' },
  { label: '일', color: 'text-sunday' },
];

const groups = [
  {
    name: '회사에서 할 일',
    color: CORAL,
    todos: [
      { title: '주간 보고서 쓰기', done: true },
      { title: '디자인 리뷰 준비', done: false },
    ],
  },
  {
    name: '혼자 하는 일',
    color: LEMON,
    todos: [
      { title: '러닝 30분', done: true },
      { title: '책 20쪽 읽기', done: false },
    ],
  },
];

function Check({ color, done }: { color: string; done: boolean }) {
  return (
    <span
      className="squircle grid h-[18px] w-[18px] shrink-0 place-items-center"
      style={
        done
          ? { background: color }
          : { boxShadow: `inset 0 0 0 1.5px ${color}`, background: 'transparent' }
      }
    >
      {done && (
        <svg viewBox="0 0 12 12" className="h-[11px] w-[11px]" aria-hidden>
          <path
            d="M2.5 6.3 L5 8.6 L9.5 3.6"
            fill="none"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

export function BoardPreview() {
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-white shadow-[0_18px_50px_-24px_rgba(17,17,17,0.28)]">
      {/* 스코프 바 — 내 보드와 크루·친구 보드를 오가는 칩 */}
      <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
        <span className="flex items-center gap-1.5 rounded-full bg-ink py-1 pr-3 pl-1 text-[11.5px] font-semibold text-white">
          <span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-white/20 text-[9.5px]">
            하
          </span>
          하루
        </span>
        {['달리기모임', '민서'].map((name) => (
          <span
            key={name}
            className="flex items-center gap-1.5 rounded-full bg-chip py-1 pr-3 pl-1 text-[11.5px] text-subtle"
          >
            <span className="grid h-[19px] w-[19px] place-items-center rounded-full bg-blob text-[9.5px] text-ink/60">
              {name[0]}
            </span>
            {name}
          </span>
        ))}
      </div>

      <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-[1.35fr_1fr]">
        {/* 캘린더 */}
        <div>
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="text-[19px] font-extrabold tracking-tight">2026년 9월</span>
          </div>

          <div className="grid grid-cols-7 gap-x-1">
            {weekdays.map((day) => (
              <div
                key={day.label}
                className={`pb-2 text-center text-[10.5px] font-medium ${day.color}`}
              >
                {day.label}
              </div>
            ))}

            {days.map((day, index) =>
              day === null ? (
                <div key={`empty-${index}`} />
              ) : (
                <div
                  key={day.date}
                  className="rise flex flex-col items-center gap-1 pb-2.5"
                  style={{ animationDelay: `${140 + index * 9}ms` }}
                >
                  <span
                    className="squircle grid h-7 w-7 place-items-center text-[11px] font-semibold"
                    style={
                      day.today
                        ? { background: '#111111', color: 'white' }
                        : { background: '#dde0e4', color: '#111111' }
                    }
                  >
                    {day.date}
                  </span>

                  <span className="flex h-[9px] w-full max-w-7 flex-col justify-start gap-[2px] px-[3px]">
                    {day.bands?.map((band) => (
                      <span
                        key={band}
                        className="block h-[3px] w-full rounded-full"
                        style={{ background: band }}
                      />
                    ))}
                  </span>

                  <span className="h-[11px] text-[9.5px] leading-none text-subtle">
                    {day.bands && (day.remaining ? day.remaining : '✓')}
                  </span>
                </div>
              ),
            )}
          </div>
        </div>

        {/* 그 날의 할 일 */}
        <div className="rise space-y-4 md:border-l md:border-line md:pl-5" style={{ animationDelay: '460ms' }}>
          {groups.map((group) => (
            <div key={group.name}>
              <div
                className="mb-2 inline-flex rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                style={{ background: `${group.color}1f`, color: group.color }}
              >
                {group.name}
              </div>
              <ul className="space-y-1.5">
                {group.todos.map((todo) => (
                  <li key={todo.title} className="flex items-center gap-2">
                    <Check color={group.color} done={todo.done} />
                    <span
                      className={`text-[12.5px] ${todo.done ? 'text-subtle line-through decoration-subtle' : 'text-ink'}`}
                    >
                      {todo.title}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
