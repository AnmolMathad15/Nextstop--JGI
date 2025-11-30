import { useState } from "react";
import { Bus, Users, Route, UserCircle, Plus, Pencil, Trash2, Search, Eye, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface BusData {
  id: string;
  number: string;
  capacity: number;
  isActive: boolean;
}

interface RouteData {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

interface DriverData {
  id: string;
  userId: string;
  licenseNumber: string | null;
  assignedBusId: string | null;
  user: { id: string; username: string; name: string | null; phone: string | null } | null;
}

interface StudentData {
  id: string;
  userId: string;
  usn: string;
  preferredRouteId: number | null;
  preferredStop: string | null;
  user: { id: string; username: string; name: string | null } | null;
}

interface AdminDashboardProps {
  onViewLiveMap?: () => void;
}

export default function AdminDashboard({ onViewLiveMap }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"bus" | "driver" | "student">("bus");

  const { data: buses = [] } = useQuery<BusData[]>({ queryKey: ["/api/buses"] });
  const { data: routes = [] } = useQuery<RouteData[]>({ queryKey: ["/api/routes"] });
  const { data: drivers = [] } = useQuery<DriverData[]>({ queryKey: ["/api/drivers"] });
  const { data: students = [] } = useQuery<StudentData[]>({ queryKey: ["/api/students"] });
  const { data: activeTrips = [] } = useQuery<any[]>({ queryKey: ["/api/trips/active"] });

  const stats = [
    { label: "Total Buses", value: buses.length, icon: Bus, color: "bg-primary" },
    { label: "Active Drivers", value: drivers.length, icon: UserCircle, color: "bg-blue-500" },
    { label: "Total Routes", value: routes.length, icon: Route, color: "bg-green-500" },
    { label: "Registered Students", value: students.length, icon: Users, color: "bg-yellow-500" },
  ];

  const openAddDialog = (type: "bus" | "driver" | "student") => {
    setDialogType(type);
    setIsAddDialogOpen(true);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-admin-title">
            Admin Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">Manage buses, routes, drivers and students</p>
        </div>
        <Button
          className="gap-2 bg-primary"
          onClick={onViewLiveMap}
          data-testid="button-view-live-map"
        >
          <MapPin className="h-4 w-4" />
          Live Map ({activeTrips.length} active)
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="hover-elevate">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, "-")}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="buses" data-testid="tab-buses">Buses</TabsTrigger>
          <TabsTrigger value="drivers" data-testid="tab-drivers">Drivers</TabsTrigger>
          <TabsTrigger value="students" data-testid="tab-students">Students</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Routes Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {routes.map((route) => (
                  <div key={route.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{route.name}</p>
                      <p className="text-sm text-muted-foreground">Order: {route.displayOrder}</p>
                    </div>
                    <Badge variant={route.isActive ? "default" : "secondary"} className="gap-1">
                      <Bus className="h-3 w-3" />
                      {route.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buses" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-buses"
              />
            </div>
            <Button onClick={() => openAddDialog("bus")} className="gap-2" data-testid="button-add-bus">
              <Plus className="h-4 w-4" />
              Add Bus
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bus Number</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buses.filter(b => b.number.toLowerCase().includes(searchQuery.toLowerCase())).map((bus) => (
                  <TableRow key={bus.id} data-testid={`row-bus-${bus.id}`}>
                    <TableCell className="font-medium">{bus.number}</TableCell>
                    <TableCell>{bus.capacity} seats</TableCell>
                    <TableCell>
                      <Badge variant={bus.isActive ? "default" : "secondary"}>
                        {bus.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" data-testid={`button-edit-bus-${bus.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive" data-testid={`button-delete-bus-${bus.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search drivers..." className="pl-9" data-testid="input-search-drivers" />
            </div>
            <Button onClick={() => openAddDialog("driver")} className="gap-2" data-testid="button-add-driver">
              <Plus className="h-4 w-4" />
              Add Driver
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>License</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
                    <TableCell className="font-medium">{driver.id.slice(0, 8)}...</TableCell>
                    <TableCell>{driver.user?.name || driver.user?.username || "N/A"}</TableCell>
                    <TableCell>{driver.user?.phone || "N/A"}</TableCell>
                    <TableCell>{driver.licenseNumber || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="students" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search students by USN..." className="pl-9" data-testid="input-search-students" />
            </div>
            <Button onClick={() => openAddDialog("student")} className="gap-2" data-testid="button-add-student">
              <Plus className="h-4 w-4" />
              Add Student
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>USN</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Preferred Stop</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => (
                  <TableRow key={student.id} data-testid={`row-student-${student.usn}`}>
                    <TableCell className="font-medium">{student.usn}</TableCell>
                    <TableCell>{student.user?.name || student.user?.username || "N/A"}</TableCell>
                    <TableCell>{student.preferredStop || "Not set"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New {dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}</DialogTitle>
            <DialogDescription>
              Fill in the details to add a new {dialogType} to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {dialogType === "bus" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="bus-number">Bus Number</Label>
                  <Input id="bus-number" placeholder="KA-25-X-0000" data-testid="input-new-bus-number" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="bus-capacity">Capacity</Label>
                  <Input id="bus-capacity" type="number" placeholder="40" defaultValue={40} />
                </div>
              </>
            )}
            {dialogType === "driver" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="driver-name">Name</Label>
                  <Input id="driver-name" placeholder="Full name" data-testid="input-new-driver-name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="driver-phone">Phone</Label>
                  <Input id="driver-phone" placeholder="+91 XXXXXXXXXX" data-testid="input-new-driver-phone" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="driver-license">License Number</Label>
                  <Input id="driver-license" placeholder="KA-XX-XXXXX" />
                </div>
              </>
            )}
            {dialogType === "student" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="student-usn">USN</Label>
                  <Input id="student-usn" placeholder="2JI20XX000" data-testid="input-new-student-usn" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="student-name">Name</Label>
                  <Input id="student-name" placeholder="Full name" data-testid="input-new-student-name" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="student-route">Preferred Route</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                      {routes.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          {route.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              console.log(`Adding new ${dialogType}`);
              setIsAddDialogOpen(false);
            }} data-testid={`button-save-${dialogType}`}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
