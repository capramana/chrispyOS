import MementoPage, {
  type MementoDevConfirmPreview,
} from "@/app/components/MementoPage";

const DEV_CONFIRM_PREVIEW: MementoDevConfirmPreview = {
  name: "Alex",
  socialType: "twitter",
  drawing: `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80" viewBox="0 0 120 80"><path d="M12 52 Q36 18 60 44 T108 28" stroke="#0a0908" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>',
  )}`,
  size: { width: 120, height: 80 },
};

type PageProps = {
  searchParams: Promise<{ step?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const devConfirmPreview =
    process.env.NODE_ENV === "development" && params.step === "3"
      ? DEV_CONFIRM_PREVIEW
      : null;

  return <MementoPage devConfirmPreview={devConfirmPreview} />;
}
