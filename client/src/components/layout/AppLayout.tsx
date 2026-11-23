import { Outlet } from 'react-router';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

/**
 * Flex-wrap shell from the mockups: on wide screens the sidebar sits left of the content; on
 * narrow screens the content's large flex-basis forces a wrap and the sidebar stacks on top.
 */
export const AppLayout = () => (
  <div className="flex min-h-screen flex-wrap bg-background text-foreground">
    <Sidebar />
    <div className="flex min-w-0 grow-[999] basis-[560px] flex-col">
      <TopBar />
      <main className="box-border flex w-full max-w-[1280px] flex-col gap-6 px-4 pb-10 pt-7 md:px-8">
        <Outlet />
      </main>
    </div>
  </div>
);
