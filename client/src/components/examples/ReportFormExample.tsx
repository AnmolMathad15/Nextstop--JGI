import ReportForm from "../ReportForm";

export default function ReportFormExample() {
  const handleSubmit = async (data: { reason: string; notes: string; photo?: File }) => {
    console.log("Report submitted:", data);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log("Report sent successfully!");
  };

  return <ReportForm onSubmit={handleSubmit} />;
}
