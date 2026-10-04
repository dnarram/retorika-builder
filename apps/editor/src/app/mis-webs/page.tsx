import { MyWebs } from "@/account/MyWebs.tsx";
import es from "@/locales/es.json" with { type: "json" };

export const metadata = { title: es["myWebs.title"] };

export default function Page() {
  return <MyWebs />;
}
