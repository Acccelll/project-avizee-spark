import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MaskedInput } from "@/components/ui/MaskedInput";

describe("MaskedInput", () => {
  it("deve aplicar máscara de CNPJ", () => {
    const onChange = vi.fn();

    render(<MaskedInput mask="cnpj" value="" onChange={onChange} aria-label="cnpj" />);

    fireEvent.change(screen.getByLabelText("cnpj"), { target: { value: "12345678000199" } });

    expect(onChange).toHaveBeenCalledWith("12.345.678/0001-99");
  });
});
