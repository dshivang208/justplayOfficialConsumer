import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Users } from "lucide-react";
import { useCommunity } from "@/lib/community";
import { useAuth } from "@/lib/auth";
import { Section, SectionHeading } from "./SectionHeading";
import { GroupCard } from "./GroupCard";
import { Button } from "./Button";
import { SkeletonGrid, EmptyState } from "./states";

export function GroupsSection() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { groups, joinedGroupIds, joinGroup, leaveGroup, loading, hydrated } = useCommunity();
  const isLoading = loading && !hydrated;
  // Real, live groups only — highest member count first (loadGroups()
  // already orders by member_count), capped to a homepage preview. No
  // demo/mock rows here; "Explore Groups" links to /groups for the full,
  // filterable directory.
  const featured = groups.slice(0, 4);

  const handleToggle = async (groupId: string, joined: boolean) => {
    if (!isAuthenticated) {
      void navigate({ to: "/auth", search: { redirect: "/" } });
      return;
    }
    try {
      if (joined) {
        await leaveGroup(groupId);
        toast.success("You've left the group");
      } else {
        const status = await joinGroup(groupId);
        toast.success(
          status === "pending" ? "Request sent to the group admin" : "You're in the group!",
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update your membership.");
    }
  };

  return (
    <Section id="groups">
      <SectionHeading
        eyebrow="Your people"
        title="Groups"
        subtitle="Regular crews that play every week. Join one and never look for players again."
        action={
          <Button asChild variant="outline">
            <Link to="/groups">
              Explore Groups <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonGrid count={4} className="lg:grid-cols-4" />
      ) : featured.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No groups yet"
          description="Start the first sports community in your area."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              joined={joinedGroupIds.includes(group.id)}
              requested={group.pendingRequests.some((p) => p.id === user?.id)}
              onToggle={() => handleToggle(group.id, joinedGroupIds.includes(group.id))}
            />
          ))}
        </div>
      )}
    </Section>
  );
}