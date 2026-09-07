import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/api";
import { trpc } from "@/lib/trpc";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminAccessPage() {
  const utils = trpc.useUtils();
  const { data: admins, isLoading } = trpc.admins.list.useQuery();
  const session = getSession();
  const myAdminId = session?.role === "admin" ? session.adminUserId : null;

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [resetTarget, setResetTarget] = useState<{ id: number; name: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });

  const createMutation = trpc.admins.create.useMutation({
    onSuccess: () => { utils.admins.list.invalidate(); setAddOpen(false); toast.success("Admin added. Share their email and password with them."); },
    onError: (err) => toast.error(err.message),
  });
  const removeMutation = trpc.admins.remove.useMutation({
    onSuccess: () => { utils.admins.list.invalidate(); toast.success("Admin removed."); },
    onError: (err) => toast.error(err.message),
  });
  const resetMutation = trpc.admins.resetPassword.useMutation({
    onSuccess: () => { setResetTarget(null); setResetPassword(""); toast.success("Password updated. Let them know the new one."); },
    onError: (err) => toast.error(err.message),
  });
  const changeMutation = trpc.admins.changeMyPassword.useMutation({
    onSuccess: () => { setPw({ current: "", next: "" }); toast.success("Your password has been changed."); },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin Access</h1>
          <p className="text-muted-foreground text-sm">
            Admins sign into this dashboard with their own email and password.
          </p>
        </div>
        <Button onClick={() => { setForm({ name: "", email: "", password: "" }); setAddOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />Add Admin
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Admins ({admins?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Loading…</div>
          ) : !admins || admins.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No admin accounts yet — everyone is using the master password. Add the first one above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.name}
                      {u.id === myAdminId && <Badge variant="outline" className="ml-2 text-xs">You</Badge>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Set a new password"
                          onClick={() => { setResetPassword(""); setResetTarget({ id: u.id, name: u.name }); }}>
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                        {u.id !== myAdminId && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => { if (confirm(`Remove ${u.name}'s admin access?`)) removeMutation.mutate({ id: u.id }); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {myAdminId !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change My Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                changeMutation.mutate({ currentPassword: pw.current, newPassword: pw.next });
              }}
            >
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input type="password" value={pw.current} onChange={(e) => setPw((v) => ({ ...v, current: e.target.value }))} required autoComplete="current-password" />
              </div>
              <div className="space-y-1.5">
                <Label>New password (8+ characters)</Label>
                <Input type="password" value={pw.next} onChange={(e) => setPw((v) => ({ ...v, next: e.target.value }))} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" disabled={changeMutation.isPending}>
                {changeMutation.isPending ? "Saving…" : "Change Password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Master Password</CardTitle>
          <CardDescription>
            The master password (set in Cloudflare as ADMIN_PASSWORD) always works as a backup —
            use "Use the master password instead" on the sign-in screen. Change it in the
            Cloudflare dashboard, not here.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Add admin */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Admin</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          >
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
            </div>
            <div className="space-y-1.5">
              <Label>Password * (8+ characters)</Label>
              <Input type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required minLength={8} />
              <p className="text-xs text-muted-foreground">
                You set their starting password and share it with them — they can change it later
                on this page.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Add Admin</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetTarget} onOpenChange={(v) => { if (!v) setResetTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Set a new password for {resetTarget?.name}</DialogTitle></DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (resetTarget) resetMutation.mutate({ id: resetTarget.id, password: resetPassword });
            }}
          >
            <div className="space-y-1.5">
              <Label>New password (8+ characters)</Label>
              <Input type="text" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} required minLength={8} autoFocus />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={resetMutation.isPending}>Set Password</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
