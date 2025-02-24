import SignPageClient from "./SignPageClient";

interface PageProps {
  params: {
    token: string;
  };
}

export default async function SignPage({ params }: PageProps) {
  // In Next.js 14, we can directly use the params in an async component
  return <SignPageClient token={params.token} />;
}
