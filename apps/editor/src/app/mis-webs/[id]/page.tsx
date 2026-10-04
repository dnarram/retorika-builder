import { OpenFromAccount } from "@/account/OpenFromAccount.tsx";
import es from "@/locales/es.json" with { type: "json" };

export const metadata = { title: es["myWebs.title"] };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OpenFromAccount id={id} />;
}
