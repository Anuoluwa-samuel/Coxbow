import { Hero } from "@/components/home/hero";
import { Areas, CtaBanner, HomeFaq, HowItWorks, PopularServices, Reviews, Trust } from "@/components/home/sections";
import { generalFaqs } from "@/data/general-faqs";
import { getApprovedReviews, listServiceAreas, listServices } from "@/server/catalog";


export default async function HomePage() {
  const [services, areas, reviews] = await Promise.all([
    listServices(),
    listServiceAreas(),
    getApprovedReviews({ limit: 3 }),
  ]);
  return (
    <>
      <Hero services={services} areas={areas} />
      <PopularServices services={services.slice(0, 4)} />
      <Trust />
      <CtaBanner />
      <HowItWorks />
      <Reviews reviews={reviews} />
      <Areas areas={areas} />
      <HomeFaq faqs={generalFaqs} />
    </>
  );
}
