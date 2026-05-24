'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/auth');
  };

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  );
}
