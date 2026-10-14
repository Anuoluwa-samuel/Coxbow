import { Hero } from "@/components/home/hero";
import { Areas, FinalCta, HomeFaq, HowItWorks, PopularServices, Trust } from "@/components/home/sections";
import { generalFaqs } from "@/data/general-faqs";
import { listServiceAreas, listServices } from "@/server/catalog";


export default async function HomePage() {
  const [services, popular, areas] = await Promise.all([
    listServices(),
    listServices({ popularOnly: true }),
    listServiceAreas(),
  ]);
  return (
    <>
      <Hero services={services} areas={areas} />
      <PopularServices services={popular} />
      <HowItWorks />
      <Trust />
      <Areas areas={areas} />
      <HomeFaq faqs={generalFaqs} />
      <FinalCta />
    </>
  );
}
