import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

/** A button that asks for confirmation before running onConfirm. */
const ConfirmButton = ({ label, title, description, onConfirm, icon, variant = "ghost" }: {
  label?: string; title: string; description?: string; onConfirm: () => void; icon?: React.ReactNode; variant?: "ghost" | "outline" | "destructive";
}) => {
  const { t } = useTranslation();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size={label ? "sm" : "icon"} variant={variant} aria-label={title}>{icon}{label && <span className={icon ? "ml-2" : ""}>{label}</span>}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("platform.common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("platform.common.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConfirmButton;
