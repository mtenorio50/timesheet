import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1e3a5f] px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <div className="mb-3 text-5xl">⏳</div>
        <h1 className="mb-2 text-xl font-semibold text-gray-900">Awaiting approval</h1>
        <p className="mb-6 text-sm text-gray-600">
          Your account is pending admin approval. Please check back later or contact your manager.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
