import { useState } from "react";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { errorMessage, localDay } from "@/client/lib/format";
import { deleteEvent, saveEvent } from "@/serverFunctions/crm";
import { FormField } from "./FormField";

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string;
  notes: string;
  owner: string;
  ownerId: string;
  canEdit: boolean;
  attendees: { id: string; email: string }[];
  contacts: { id: string; name: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const localInput = (iso: string) => {
  const d = new Date(iso);
  return `${localDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Create, edit or view an event. */
export function EventForm({
  event,
  day,
  me,
  members,
  records,
  onClose,
  onSaved,
}: {
  event: CalendarEvent | null;
  day: string;
  me: string;
  members: { id: string; email: string }[];
  records: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const readOnly = event !== null && !event.canEdit;
  const [title, setTitle] = useState(event?.title ?? "");
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [date, setDate] = useState(event ? event.startsAt.slice(0, 10) : day);
  const [lastDay, setLastDay] = useState(event?.allDay ? event.endsAt.slice(0, 10) : day);
  const [starts, setStarts] = useState(event ? localInput(event.startsAt) : `${day}T09:00`);
  const [ends, setEnds] = useState(event ? localInput(event.endsAt) : `${day}T10:00`);
  const [location, setLocation] = useState(event?.location ?? "");
  const [notes, setNotes] = useState(event?.notes ?? "");
  const [attendees, setAttendees] = useState<string[]>(event?.attendees.map((a) => a.id) ?? []);
  const [linked, setLinked] = useState<string[]>(event?.contacts.map((c) => c.id) ?? []);
  const [find, setFind] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const matches = records
    .filter((r) => linked.includes(r.id) || (find.trim() && r.name.toLowerCase().includes(find.trim().toLowerCase())))
    .slice(0, 30);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Enter a title");
    // All-day events are stored as whole UTC days.
    const startsAt = allDay ? `${date}T00:00:00.000Z` : new Date(starts).toISOString();
    const endsAt = allDay ? `${lastDay < date ? date : lastDay}T23:59:59.999Z` : new Date(ends).toISOString();
    if (endsAt < startsAt) return setError("The end must be after the start");
    setPending(true);
    setError(null);
    try {
      await saveEvent({ data: { id: event?.id, title, startsAt, endsAt, allDay, location, notes, attendeeIds: attendees, contactIds: linked } });
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!event) return;
    setPending(true);
    try {
      await deleteEvent({ data: { id: event.id } });
      onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  if (readOnly && event) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{event.title}</DialogTitle>
          </DialogHeader>
          <dl className="grid gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">When</dt>
              <dd>{event.allDay ? `All day, ${event.startsAt.slice(0, 10)}` : `${new Date(event.startsAt).toLocaleString()} – ${new Date(event.endsAt).toLocaleTimeString()}`}</dd>
            </div>
            {event.location ? (
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd>{event.location}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-muted-foreground">Organizer</dt>
              <dd>{event.owner}</dd>
            </div>
            {event.notes ? <p className="whitespace-pre-line">{event.notes}</p> : null}
          </dl>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? "Edit event" : "New event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <FormField id="e-title" label="Title">
            <Input id="e-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </FormField>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox checked={allDay} onCheckedChange={(v) => setAllDay(v === true)} aria-label="All day" />
            All day
          </div>
          {allDay ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="e-date" label="Date">
                <Input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </FormField>
              <FormField id="e-last" label="Last day">
                <Input id="e-last" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
              </FormField>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField id="e-starts" label="Starts">
                <Input id="e-starts" type="datetime-local" value={starts} onChange={(e) => setStarts(e.target.value)} />
              </FormField>
              <FormField id="e-ends" label="Ends">
                <Input id="e-ends" type="datetime-local" value={ends} onChange={(e) => setEnds(e.target.value)} />
              </FormField>
            </div>
          )}
          <FormField id="e-location" label="Location">
            <Input id="e-location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </FormField>
          <FormField id="e-notes" label="Notes">
            <Textarea id="e-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
          {members.some((m) => m.id !== me) ? (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium">Invite</legend>
              {members
                .filter((m) => m.id !== me)
                .map((m) => (
                  <div key={m.id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={attendees.includes(m.id)} onCheckedChange={() => setAttendees((a) => toggle(a, m.id))} aria-label={m.email} />
                    {m.email}
                  </div>
                ))}
            </fieldset>
          ) : null}
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Linked records</legend>
            <Input aria-label="Find a record" placeholder="Find a contact or company" value={find} onChange={(e) => setFind(e.target.value)} />
            {matches.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={linked.includes(r.id)} onCheckedChange={() => setLinked((l) => toggle(l, r.id))} aria-label={r.name} />
                {r.name}
              </div>
            ))}
          </fieldset>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            {event ? (
              <Button type="button" variant="destructive" className="sm:mr-auto" disabled={pending} onClick={remove}>
                Delete
              </Button>
            ) : null}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
