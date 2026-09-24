import { AppHeader } from "@/components/app-header";
import { TodoApp } from "@/components/todo-app";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-16">
      <AppHeader />
      <TodoApp />
    </main>
  );
}
