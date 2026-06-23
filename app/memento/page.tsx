import MementoPage from "@/app/components/MementoPage";
import { resolveDevConfirmPreview } from "./devConfirmPreview";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ step?: string | string[]; "step=3"?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const devConfirmPreview = resolveDevConfirmPreview(params);

  return <MementoPage devConfirmPreview={devConfirmPreview} />;
}
