import * as React from "react";

export const Table = ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
  <div className={`ds-table-wrap ${className}`}>
    <table className="ds-table">{children}</table>
  </div>
);

export const TableHeader = ({ children }: React.PropsWithChildren) => <thead className="ds-table-head">{children}</thead>;

export const TableBody = ({ children }: React.PropsWithChildren) => <tbody>{children}</tbody>;

export const TableHead = ({
  children,
  onClick,
  className = "",
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th className={`ds-table-head-cell ${className}`} onClick={onClick} {...props}>
    {children}
  </th>
);

export const TableRow = ({ children, className = "", ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr className={`ds-table-row ${className}`} {...props}>
    {children}
  </tr>
);

export const TableCell = ({ children, className = "" }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={`ds-table-cell ${className}`}>{children}</td>
);
