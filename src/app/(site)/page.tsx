import { Hero } from "@/components/home/hero";
import { Areas, FinalCta, HomeFaq, HowItWorks, PopularServices, Reviews, Trust } from "@/components/home/sections";
import { generalFaqs } from "@/data/general-faqs";
import { getApprovedReviews, listServiceAreas, listServices } from "@/server/catalog";


export default async function HomePage() {
  const [services, popular, areas, reviews] = await Promise.all([
    listServices(),
    listServices({ popularOnly: true }),
    listServiceAreas(),
    getApprovedReviews({ limit: 3 }),
  ]);
  return (
    <>
      <Hero services={services} areas={areas} />
      <PopularServices services={popular} />
      <HowItWorks />
      <Trust />
      <Reviews reviews={reviews} />
      <Areas areas={areas} />
      <HomeFaq faqs={generalFaqs} />
      <FinalCta />
    </>
  );
}
