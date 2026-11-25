import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "team-crm",
  name: "Team CRM",
  description:
    "A shared contact manager for small teams: people and companies, notes and files, tasks, pipelines and a calendar.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // Files attached to contact and company timelines.
    r2: ["files"],
  },
  capabilities: {
    members: { access: "read", why: "Shows teammates' names on the team access page." },
    email: { access: "write", why: "Sends each member who turns it on a morning email with their tasks and events." },
  },
  features: {
    agenda: {
      name: "Morning agenda email",
      why: "Members can get their day's tasks and events by email each morning.",
      capabilities: ["email"],
    },
  },
});
