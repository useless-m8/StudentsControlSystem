type HeaderProps = {
  title: string;
  text: string;
};

export function Header({ title, text }: HeaderProps) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  );
}
