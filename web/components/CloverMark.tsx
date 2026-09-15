/** 앱 아이콘의 네잎 하트 클로버. 하트 꼭짓점이 가운데에서 만난다. */
export function CloverMark({ className = '' }: { className?: string }) {
  const heart =
    'M 0 0 C -14 -13, -33 -25, -33 -42 C -33 -57, -13 -59, 0 -44 C 13 -59, 33 -57, 33 -42 C 33 -25, 14 -13, 0 0 Z';

  // 앱 아이콘에서 뽑은 색. 왼쪽 위부터 시계 방향.
  const petals = [
    { rotate: -45, fill: '#ffee6e' },
    { rotate: 45, fill: '#ffa3d7' },
    { rotate: 135, fill: '#ff7454' },
    { rotate: -135, fill: '#98d2ff' },
  ];

  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="Todo Buddy">
      {petals.map((petal) => (
        <path
          key={petal.rotate}
          d={heart}
          fill={petal.fill}
          transform={`translate(50 50) rotate(${petal.rotate}) scale(0.82)`}
        />
      ))}
    </svg>
  );
}
