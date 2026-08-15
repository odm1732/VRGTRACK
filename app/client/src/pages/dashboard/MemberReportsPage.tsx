import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ChevronRight, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

export default function MemberReportsPage() {
  const { data: members, isLoading } = trpc.members.listAll.useQuery();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!members) return [];
    if (!search) return members;
    return members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));
  }, [members, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Member Reports</h1>
        <p className="text-muted-foreground text-sm">View individual performance for each member.</p>
      </div>

      <Input placeholder="Search members…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Card key={i}><CardContent className="h-16 animate-pulse bg-muted rounded mt-4" /></Card>)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No members found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.active ? "Active" : "Inactive"}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/dashboard/members/${m.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
