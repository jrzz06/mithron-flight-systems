import type { FooterColumn } from "@/config/storefront-content";

export const footerOfficialLinks = {
  mithronSmart: "https://www.mithronsmart.com",
  mithronStore: "/",
  agrone: "https://www.mithronsmart.com/agri-drone-business",
  zroneo: "https://play.google.com/store/apps/details?id=com.mithronfarmer",
  droningPlatform: "https://drone.mithronsmart.com",
  droningLogin: "https://drone.mithronsmart.com/selectlogin",
  droneEmi: "https://drone.mithronsmart.com/drone-emi",
  linkedIn: "https://www.linkedin.com/company/mithron-india-smart-services-pvt-ltd/",
  instagram: "https://www.instagram.com/mithronsmart/",
  facebook: "https://www.facebook.com/p/Mithron-India-Agtech-100088815738230/",
  youtube: "https://www.youtube.com/channel/UCzeHU4vY6q1y1xrGkXsv5ow",
  yourStory: "https://yourstory.com/companies/mithron",
  tracxn: "https://tracxn.com/d/companies/mithronsmart/__FmiZvI2eEsKhWNfarQr2GubD-_ogeU7kHosSGe9dQSo",
  cioTechOutlook: "https://www.ciotechoutlook.com/technology/drone-tech-startups/vendor/2025/mithron",
  contactEmail: "dronecare@mithronsmart.com",
  contactPhone: "+918939123421"
} as const;

export const footerColumns: FooterColumn[] = [
  {
    title: "Official platforms",
    links: [
      ["Mithron Smart Platform", footerOfficialLinks.mithronSmart],
      ["Mithron Store", footerOfficialLinks.mithronStore],
      ["AGRONE (Agri Drone Platform)", footerOfficialLinks.agrone],
      ["ZRONEO (City Drone App)", footerOfficialLinks.zroneo],
      ["Droning Platform", footerOfficialLinks.droningPlatform],
      ["Droning Login Selector", footerOfficialLinks.droningLogin],
      ["Drone EMI Portal", footerOfficialLinks.droneEmi]
    ]
  },
  {
    title: "Shop this store",
    links: [
      ["Agri Drones", "/category/agri-drones"],
      ["Video Drones", "/category/video-drones"],
      ["Survey Drones", "/category/survey-drones"],
      ["Accessories & Drone Care", "/category/accessories"],
      ["All Products", "/products"],
      ["Contact", "/contact"]
    ]
  },
  {
    title: "Social media",
    links: [
      ["Mithron LinkedIn", footerOfficialLinks.linkedIn],
      ["Mithron Instagram", footerOfficialLinks.instagram],
      ["Mithron Facebook", footerOfficialLinks.facebook],
      ["Mithron YouTube", footerOfficialLinks.youtube]
    ]
  },
  {
    title: "Company profiles",
    links: [
      ["YourStory — Mithron Profile", footerOfficialLinks.yourStory],
      ["Tracxn — Mithronsmart Profile", footerOfficialLinks.tracxn],
      ["CIO Tech Outlook — Mithron Feature", footerOfficialLinks.cioTechOutlook]
    ]
  }
];
