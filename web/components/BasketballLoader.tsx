export function BasketballLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16">
      <div>
        <div className="ball-bounce text-4xl select-none text-center">🏀</div>
        <div
          className="ball-shadow mx-auto mt-1 rounded-full"
          style={{ width: 20, height: 3, background: "rgba(0,0,0,0.12)" }}
        />
      </div>
      <span className="text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </span>
    </div>
  );
}
