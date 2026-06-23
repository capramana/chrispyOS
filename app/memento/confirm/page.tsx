import { notFound } from "next/navigation";
import MementoPage from "@/app/components/MementoPage";
import { DEV_CONFIRM_PREVIEW } from "../devConfirmPreview";

export default function DevConfirmPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <MementoPage devConfirmPreview={DEV_CONFIRM_PREVIEW} />;
}
