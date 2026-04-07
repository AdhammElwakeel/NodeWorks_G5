import { Box } from "@mantine/core";
import {
  Navbar,
  HeroSection,
  FeaturesSection,
  HowItWorksSection,
  StatsBar,
  CTASection,
  Footer,
} from "@/components/landing";

export default function HomePage() {
  return (
    <Box component="main" mih="100vh" bg="white">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <StatsBar />
      <CTASection />
      <Footer />
    </Box>
  );
}
