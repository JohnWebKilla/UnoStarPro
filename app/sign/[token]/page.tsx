import SignPageClient from "./SignPageClient";

interface PageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function SignPage({ params }: PageProps) {
  // We need to await the params before accessing its properties
  const resolvedParams = await params;
  return <SignPageClient token={resolvedParams.token} />;
}
