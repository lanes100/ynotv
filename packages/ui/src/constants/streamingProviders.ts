export type StreamingService = 'netflix' | 'disney' | 'hulu' | 'prime' | 'apple' | 'max' | 'paramount' | 'peacock';

export interface ServiceDefinition {
  id: number;
  providerIds?: number[];
  name: string;
  logo: string;
  tint: string;
  logoHeight?: number;
  logoFilter?: string;
}

export const SERVICES: Record<StreamingService, ServiceDefinition> = {
  netflix: { id: 8, name: "Netflix", logo: "/services/netflix.svg", tint: "#E50914" },
  disney: {
    id: 337,
    name: "Disney+",
    logo: "/services/disney.svg",
    tint: "#0E47A1",
    logoHeight: 46,
    logoFilter: "brightness(0) invert(1)",
  },
  hulu: { id: 15, name: "Hulu", logo: "/services/hulu.svg", tint: "#1CE783" },
  prime: { id: 9, providerIds: [9, 119], name: "Prime Video", logo: "/services/prime.svg", tint: "#00A8E1" },
  apple: { id: 350, name: "Apple TV+", logo: "/services/apple.svg", tint: "#FFFFFF" },
  max: { id: 1899, providerIds: [1899, 384], name: "Max", logo: "/services/max.svg", tint: "#9B6CFF" },
  paramount: {
    id: 531,
    providerIds: [531, 582, 1715, 1854],
    name: "Paramount+",
    logo: "/services/paramount.svg",
    tint: "#0064FF",
  },
  peacock: { id: 386, providerIds: [386, 387], name: "Peacock", logo: "/services/peacock.svg", tint: "#FF7112" },
};

export function providerIdsFor(svc: ServiceDefinition): string {
  const ids = svc.providerIds ?? [svc.id];
  return ids.join("|");
}
