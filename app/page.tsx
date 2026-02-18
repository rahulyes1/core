export const dynamic = 'force-dynamic';

import TopBar from '../components/home/TopBar';
import NoteFeed from '../components/home/NoteFeed';
import FAB from '../components/home/FAB';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
      <TopBar />
      <NoteFeed />
      <FAB />
    </div>
  );
}