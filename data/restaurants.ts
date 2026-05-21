export type Restaurant = {
  slug: string;
  name: string;
  city: string;
  area: string;
  whatsapp: string;
  brandColor: string;
};

export const restaurants: Restaurant[] = [
  {
    slug: "albasha",
    name: "مطعم الباشا",
    city: "صنعاء",
    area: "حدة",
    whatsapp: "967770000000",
    brandColor: "#f59e0b"
  },
  {
    slug: "cafeaden",
    name: "كافيه عدن",
    city: "عدن",
    area: "كريتر",
    whatsapp: "967771111111",
    brandColor: "#14b8a6"
  }
];

export function getRestaurant(slug: string) {
  return restaurants.find((restaurant) => restaurant.slug === slug);
}
