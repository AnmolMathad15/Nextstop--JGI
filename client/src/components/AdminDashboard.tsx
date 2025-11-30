import { useState } from "react";
import { Bus, Users, Route, UserCircle, Plus, Pencil, Trash2, Search, Eye } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROUTES_DATA } from "@/lib/constants";

// todo: remove mock data - replace with API calls
const mockBuses = [
  { id: "BUS001", number: "KA-25-A-1234", route: "keshwapur route", driver: "Ravi Patil", status: "active" },
  { id: "BUS002", number: "KA-25-B-5678", route: "Pg route", driver: "Suresh Kumar", status: "active" },
  { id: "BUS003", number: "KA-25-C-9012", route: "Dharwad route", driver: "Mohan Singh", status: "inactive" },
  { id: "BUS004", number: "KA-25-D-3456", route: "Navangar route", driver: "Prakash Reddy", status: "active" },
];

const mockDrivers = [
  { id: "DRV001", name: "Ravi Patil", phone: "+91 9876543210", bus: "KA-25-A-1234", status: "active" },
  { id: "DRV002", name: "Suresh Kumar", phone: "+91 9876543211", bus: "KA-25-B-5678", status: "active" },
  { id: "DRV003", name: "Mohan Singh", phone: "+91 9876543212", bus: "KA-25-C-9012", status: "inactive" },
  { id: "DRV004", name: "Prakash Reddy", phone: "+91 9876543213", bus: "KA-25-D-3456", status: "active" },
];

const mockStudents = [
  { usn: "2JI20CS001", name: "Rahul Kumar", route: "keshwapur route", stop: "Shakti Colony" },
  { usn: "2JI20CS002", name: "Priya Sharma", route: "Pg route", stop: "tolankeri" },
  { usn: "2JI20CS003", name: "Amit Singh", route: "Dharwad route", stop: "Srinagar Dharwad" },
  { usn: "2JI20CS004", name: "Sneha Patil", route: "Navangar route", stop: "navnagar" },
];

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<"bus" | "driver" | "student">("bus");

  const stats = [
    { label: "Total Buses", value: mockBuses.length, icon: Bus, color: "bg-primary" },
    { label: "Active Drivers", value: mockDrivers.filter((d) => d.status === "active").length, icon: UserCircle, color: "bg-blue-500" },
    { label: "Total Routes", value: ROUTES_DATA.length, icon: Route, color: "bg-green-500" },
    { label: "Registered Students", value: mockStudents.length, icon: Users, color: "bg-yellow-500" },
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
          variant="outline"
          className="gap-2"
          onClick={() => console.log("View live map")}
          data-testid="button-view-live-map"
        >
          <Eye className="h-4 w-4" />
          Live Map
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
                {ROUTES_DATA.map((route) => (
                  <div key={route.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{route.name}</p>
                      <p className="text-sm text-muted-foreground">{route.stops.length} stops</p>
                    </div>
                    <Badge variant="outline" className="gap-1">
                      <Bus className="h-3 w-3" />
                      Active
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
                  <TableHead>Route</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockBuses.map((bus) => (
                  <TableRow key={bus.id} data-testid={`row-bus-${bus.id}`}>
                    <TableCell className="font-medium">{bus.number}</TableCell>
                    <TableCell>{bus.route}</TableCell>
                    <TableCell>{bus.driver}</TableCell>
                    <TableCell>
                      <Badge variant={bus.status === "active" ? "default" : "secondary"}>
                        {bus.status}
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
                  <TableHead>Assigned Bus</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockDrivers.map((driver) => (
                  <TableRow key={driver.id} data-testid={`row-driver-${driver.id}`}>
                    <TableCell className="font-medium">{driver.id}</TableCell>
                    <TableCell>{driver.name}</TableCell>
                    <TableCell>{driver.phone}</TableCell>
                    <TableCell>{driver.bus}</TableCell>
                    <TableCell>
                      <Badge variant={driver.status === "active" ? "default" : "secondary"}>
                        {driver.status}
                      </Badge>
                    </TableCell>
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
                  <TableHead>Route</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockStudents.map((student) => (
                  <TableRow key={student.usn} data-testid={`row-student-${student.usn}`}>
                    <TableCell className="font-medium">{student.usn}</TableCell>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.route}</TableCell>
                    <TableCell>{student.stop}</TableCell>
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
                  <Label htmlFor="bus-route">Route</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select route" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUTES_DATA.map((route) => (
                        <SelectItem key={route.id} value={route.id.toString()}>
                          {route.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
