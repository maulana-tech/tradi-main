import { Suspense } from "react";
import { SlideShow } from "@/components/slides/SlideShow";

export const dynamic = "force-static";

export default function SlidesPage() {
  return (
    <Suspense fallback={null}>
      <SlideShow />
    </Suspense>
  );
}
