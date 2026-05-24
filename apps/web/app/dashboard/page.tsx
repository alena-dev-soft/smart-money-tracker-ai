import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { db } from '@smt/db/client';
import { trackedWallets } from '@smt/db/schema';
import SignOutButton from './sign-out-button';
import TelegramConnectButton from './telegram-connect-button';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth');
  }

  const wallets = await db
    .select()
    .from(trackedWallets)
    .where(
      and(
        eq(trackedWallets.userId, user.id),
        eq(trackedWallets.isActive, true),
      ),
    );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-1">Welcome, {user.email}</p>
          </div>
          <SignOutButton />
        </div>

        <div className="bg-gray-900 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Tracked Wallets</h2>

          {wallets.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No wallets tracked yet. Use the Telegram bot to add wallets with /follow.
            </p>
          ) : (
            <ul className="space-y-2">
              {wallets.map((w) => (
                <li
                  key={w.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3"
                >
                  <span className="font-mono text-sm text-gray-200 truncate">
                    {w.address}
                  </span>
                  <span className="text-xs text-gray-500 ml-4 shrink-0">
                    {w.chain}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <TelegramConnectButton />
      </div>
    </div>
  );
}
