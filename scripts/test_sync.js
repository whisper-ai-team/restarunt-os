import "dotenv/config"; import { syncMenuForRestaurant } from "./services/menuSyncService.js"; syncMenuForRestaurant("indian-bharath-bistro").then(() => process.exit(0));
