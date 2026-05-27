export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand text-accent text-4xl font-extrabold mb-6">
          H!
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Hello Planning</h1>
        <p className="mt-2 text-muted-foreground">
          Pianificazione risorse — Hello Tomorrow
        </p>
      </div>
    </main>
  );
}
