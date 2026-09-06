import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('lobby_rooms',{
  id:text('id').primaryKey(),public:integer('public').notNull(),protocol:integer('protocol').notNull(),capacity:integer('capacity').notNull(),
  host:text('host').notNull(),term:integer('term').notNull().default(1),ready:integer('ready').notNull().default(0),ai:integer('ai').notNull().default(0),clearTrails:integer('clear_trails').notNull().default(0),created:integer('created').notNull()
},t=>[index('lobby_room_search').on(t.public,t.protocol,t.created)]);
export const members=sqliteTable('lobby_members',{
  id:text('id').primaryKey(),room:text('room').notNull().references(()=>rooms.id,{onDelete:'cascade'}),secret:text('secret').notNull(),
  joined:integer('joined').notNull(),seen:integer('seen').notNull(),visible:integer('visible').notNull().default(1),connected:integer('connected').notNull().default(0)
},t=>[index('lobby_member_room').on(t.room,t.connected),index('lobby_member_expiry').on(t.seen)]);
export const signals=sqliteTable('lobby_signals',{
  id:integer('id').primaryKey({autoIncrement:true}),room:text('room').notNull().references(()=>rooms.id,{onDelete:'cascade'}),sender:text('sender').notNull(),recipient:text('recipient').notNull(),body:text('body').notNull(),created:integer('created').notNull()
},t=>[index('lobby_signal_inbox').on(t.recipient,t.id),index('lobby_signal_expiry').on(t.created)]);
