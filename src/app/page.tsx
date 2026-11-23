import { vi } from "@/i18n/vi";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <p className="text-lg font-semibold text-primary-strong">{vi.brand.name}</p>
      <h1 className="text-[length:var(--text-section)] leading-tight font-extrabold">{vi.brand.tagline}</h1>
      <p>{vi.placeholder.phase}</p>
    </main>
  );
}
