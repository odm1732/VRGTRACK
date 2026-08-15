import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MemberForm = { name: string; email: string };

export default function ManageMembersPage() {
  const utils = trpc.useUtils();
  const { data: members, isLoading } = trpc.members.listAll.useQuery();

  const [addOpen, setAddOpen] = useState(false);
  const [editMember, setEditMember] = useState<{ id: number; name: string; email: string; active: boolean } | null>(null);
  const [form, setForm] = useState<MemberForm>({ name: "", email: "" });

  const createMutation = trpc.members.create.useMutation({
    onSuccess: () => { utils.members.listAll.invalidate(); utils.members.list.invalidate(); setAddOpen(false); toast.success("Member added."); },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.members.update.useMutation({
    onSuccess: () => { utils.members.listAll.invalidate(); utils.members.list.invalidate(); setEditMember(null); toast.success("Member updated."); },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.members.delete.useMutation({
    onSuccess: () => { utils.members.listAll.invalidate(); utils.members.list.invalidate(); toast.success("Member removed."); },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name: form.name, email: form.email || null });
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMember) return;
    updateMutation.mutate({ id: editMember.id, name: editMember.name, email: editMember.email || null, active: editMember.active });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manage Members</h1>
          <p className="text-muted-foreground text-sm">Add, edit, or deactivate group members.</p>
        </div>
        <Button onClick={() => { setForm({ name: "", email: "" }); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Member
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Members ({members?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                    <TableCell>
                      {m.active ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-200">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditMember({ id: m.id, name: m.name, email: m.email ?? "", active: m.active })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { if (confirm(`Remove ${m.name}?`)) deleteMutation.mutate({ id: m.id }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Add Member</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editMember} onOpenChange={(v) => { if (!v) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Member</DialogTitle></DialogHeader>
          {editMember && (
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={editMember.name} onChange={(e) => setEditMember((m) => m ? { ...m, name: e.target.value } : m)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editMember.email} onChange={(e) => setEditMember((m) => m ? { ...m, email: e.target.value } : m)} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editMember.active} onCheckedChange={(v) => setEditMember((m) => m ? { ...m, active: v } : m)} />
                <Label>Active</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditMember(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
