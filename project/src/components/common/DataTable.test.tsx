import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './DataTable';

interface Row {
  id: number;
  name: string;
  age: number;
}

const ROWS: Row[] = [
  { id: 1, name: 'Margaret Hale', age: 74 },
  { id: 2, name: 'Daniel Okafor', age: 58 },
];

const COLUMNS: Column<Row>[] = [
  { header: 'Name', cell: (row) => row.name },
  { header: 'Age', cell: (row) => row.age },
];

function renderTable(props: Partial<React.ComponentProps<typeof DataTable<Row>>> = {}) {
  return render(
    <DataTable rows={ROWS} columns={COLUMNS} rowKey={(row) => row.id} {...props} />
  );
}

describe('DataTable', () => {
  it('renders every row in both the table and the stacked layout', () => {
    renderTable();
    // Rendered twice by design -- the table for wide screens, cards for narrow.
    // CSS decides which is visible, so both must contain the data.
    expect(screen.getAllByText('Margaret Hale')).toHaveLength(2);
    expect(screen.getAllByText('Daniel Okafor')).toHaveLength(2);
  });

  it('labels each value on the stacked layout', () => {
    // Without the header as an inline label, a bare value on a phone is
    // meaningless.
    renderTable();
    expect(screen.getAllByText('Name').length).toBeGreaterThan(1);
  });

  it('shows an empty state rather than an empty table', () => {
    render(
      <DataTable rows={[]} columns={COLUMNS} rowKey={(row: Row) => row.id} />
    );
    expect(screen.getByText(/nothing to show yet/i)).toBeInTheDocument();
  });

  it('shows a skeleton while loading, not a spinner', () => {
    const { container } = renderTable({ loading: true });
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.queryByText('Margaret Hale')).not.toBeInTheDocument();
  });

  it('opens a row on click', async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    renderTable({ onRowClick });

    await user.click(screen.getAllByText('Margaret Hale')[0]);
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it('opens a row from the keyboard', async () => {
    // A clickable row that cannot be reached by keyboard is not usable.
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    renderTable({ onRowClick });

    await user.tab();
    await user.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(ROWS[0]);
  });

  it('is not focusable when rows do nothing', () => {
    const { container } = renderTable();
    expect(container.querySelector('[tabindex="0"]')).not.toBeInTheDocument();
  });
});
