import appLogo from "@assets/logo_1764501998717.jpg";
import { Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
  showMenu?: boolean;
}

export default function AppHeader({ userName, userRole, onLogout, showMenu = true }: AppHeaderProps) {
  return (
    <header 
      className="flex items-center justify-between px-4 py-3 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md shadow-md"
      data-testid="app-header"
    >
      <div className="flex items-center gap-3">
        <div className="p-1 bg-yellow-400 rounded-full shadow-lg animate-pulse-glow">
          <img
            src={appLogo}
            alt="Nextstop JGI Logo"
            className="h-10 w-10 object-cover rounded-full"
            data-testid="img-app-logo"
          />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight" data-testid="text-app-name">
            Nextstop JGI
          </h1>
          {userRole && (
            <span className="text-xs text-muted-foreground capitalize" data-testid="text-user-role">
              {userRole} Dashboard
            </span>
          )}
        </div>
      </div>

      {showMenu && (
        <div className="flex items-center gap-2">
          {userName && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:block" data-testid="text-user-name">
              {userName}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" data-testid="button-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {userName && (
                <DropdownMenuItem data-testid="menu-item-profile">
                  <User className="mr-2 h-4 w-4" />
                  {userName}
                </DropdownMenuItem>
              )}
              {onLogout && (
                <DropdownMenuItem onClick={onLogout} data-testid="menu-item-logout">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
}
