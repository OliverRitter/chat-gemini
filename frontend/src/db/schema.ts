// src/db/schema.ts
import {
  pgTable,
  text,
  timestamp,
  varchar,
  primaryKey,
  uuid,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ==========================================
// 1. AUTHENTICATION TABLES (Better-Auth Compatible)
// ==========================================
// src/db/schema.ts

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Add these missing tracking columns:
  role: text("role"),
  banned: boolean("banned"),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Add these mandatory tracking columns required by Better-Auth:
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
});

// ==========================================
// 2. CHAT & GROUP ARCHITECTURE
// ==========================================
export const channels = pgTable("channels", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  isGroup: boolean("is_group").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// src/db/schema.ts - Append this table structure

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Many-to-Many Group Members Table with explicit Roles
export const channelMembers = pgTable(
  "channel_members",
  {
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).default("member").notNull(), // 'admin' | 'member'
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.channelId, table.userId] })],
);

// ==========================================
// 3. MESSAGES & MEDIA STORAGE
// ==========================================
export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  senderId: text("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cloudinary Asset Tracking table with TTL management compatibility
export const attachments = pgTable("attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id").references(() => messages.id, {
    onDelete: "cascade",
  }),
  cloudinaryPublicId: text("cloudinary_public_id").notNull(),
  fileUrl: text("file_url").notNull(),
  expiresAt: timestamp("expires_at"), // Handled by automation script later
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ==========================================
// 4. USER READ MARKERS (For Unread Badges)
// ==========================================
export const readMarkers = pgTable(
  "read_markers",
  {
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id").references(() => channels.id, {
      onDelete: "cascade",
    }),
    lastReadAt: timestamp("last_read_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.channelId] })],
);

// Better-Auth demands this exact model layout to cache confirmation and reset tokens safely
export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ==========================================
// RELATIONS DEFINITIONS (Drizzle Queries API)
// ==========================================
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(channelMembers),
  messages: many(messages),
}));

export const channelsRelations = relations(channels, ({ many }) => ({
  members: many(channelMembers),
  messages: many(messages),
}));

export const channelMembersRelations = relations(channelMembers, ({ one }) => ({
  channel: one(channels, {
    fields: [channelMembers.channelId],
    references: [channels.id],
  }),
  user: one(users, { fields: [channelMembers.userId], references: [users.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  channel: one(channels, {
    fields: [messages.channelId],
    references: [channels.id],
  }),
  attachments: many(attachments),
}));
