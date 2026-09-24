import { TodoApp } from "@/components/todo-app";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Todo Tracker</h1>
        <p className="text-sm opacity-70">
          Local-first tasks, stored in your browser.
        </p>
      </header>
      <TodoApp />
    </main>
  );
}
